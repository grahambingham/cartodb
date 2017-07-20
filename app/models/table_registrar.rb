# encoding: utf-8

module CartoDB
  class TableRegistrar
    def initialize(user, table_klass=nil)
      @user         = user
      @table_klass  = table_klass
    end

    def register(table_name, data_import_id)
      external_vis = ::DataImport[data_import_id].external_source_visualization
      metadata = if external_vis
                   {
                     description: external_vis.description,
                     tags: external_vis.tags
                   }
                 else
                   {}
                 end

      @table = Table.build(user_id: user.id,
                           table_name: table_name,
                           metadata: metadata)

      @table.register
    end

    def exists?(user, table_name)
      !table_klass.where(user_id: user.id, name: table_name).empty?
    end

    attr_reader :user, :table

    private

    attr_reader :table_klass
    attr_writer :table

    def set_metadata_from_data_import_id(table, data_import_id)
      external_data_import = ExternalDataImport.where(data_import_id: data_import_id).first
      if external_data_import
        external_source = CartoDB::Visualization::ExternalSource.where(id: external_data_import.external_source_id).first
        if external_source
          visualization = external_source.visualization
          if visualization
            table.description = visualization.description
            table.set_tag_array(visualization.tags)
          end
        end
      end
    rescue => e
      CartoDB.notify_exception(e)
      raise e
    end
  end # TableRegistrar
end # CartoDB
